import { parse } from 'node-html-parser';
import type { AnalyzableImage } from './analyzer.interface.js';
import type { AiReviewer, AiVerdict } from './ai-reviewer.interface.js';
import type {
  AnalysisCheckInterface,
  AnalysisFindingInterface,
  AnalysisInterface,
  CheckStatus,
} from './check.interface.js';
import type {
  AiCheckUpdateInput,
  AiFindingReviewInput,
  AnalysisRepository,
} from '../infrastructure/persistence/analysis.repository.js';
import type { HtmlDocumentReader } from '../infrastructure/persistence/html-document.reader.js';
import { computeScore } from './score.js';
import { NotFoundError } from './errors.js';

// Reglas candidatas a IA (docs 0005 §3/§7) y el flow que las resuelve.
type Reviewer = 'altText' | 'containsText' | 'decorative';

const RULE_REVIEWER: Record<string, Reviewer> = {
  IMG_TEXT_IN_IMAGE: 'containsText',
  IMG_GENERIC_ALT: 'altText',
  IMG_LINKED_NO_ALT: 'altText',
  IMG_EMPTY_ALT_SUSPECT: 'decorative',
};

// Estado que confirma un incumplimiento real, según la severidad ya definida
// para la regla en el analizador estático (docs 0004 §7).
const FAIL_STATUS: Record<string, CheckStatus> = {
  IMG_TEXT_IN_IMAGE: 'ERROR',
  IMG_GENERIC_ALT: 'AVISO',
  IMG_LINKED_NO_ALT: 'ERROR',
  IMG_EMPTY_ALT_SUSPECT: 'AVISO',
};

/**
 * Caso de uso: revisar por IA los checks candidatos de un análisis ya
 * existente (docs 0005 §7). Actualiza el mismo registro: por cada finding sin
 * revisar invoca el puerto `AiReviewer` con la entrada mínima (imagen + alt/
 * contexto), guarda su veredicto y recalcula el estado del check y el score.
 */
export class ReviewAnalysisWithAiUseCase {
  constructor(
    private readonly analyses: AnalysisRepository,
    private readonly documents: HtmlDocumentReader,
    private readonly aiReviewer: AiReviewer,
  ) {}

  async execute(rawId: unknown): Promise<AnalysisInterface> {
    const id = Number(rawId);
    if (!Number.isInteger(id)) {
      throw new NotFoundError('Análisis no encontrado');
    }

    const analysis = await this.analyses.findById(id);
    if (!analysis) {
      throw new NotFoundError('Análisis no encontrado');
    }

    const document = await this.documents.findById(analysis.htmlId);
    if (!document) {
      throw new NotFoundError('Documento HTML no encontrado');
    }

    const candidates = analysis.checks.filter(
      (check) => RULE_REVIEWER[check.rule] !== undefined && check.findings.length > 0,
    );

    const findingUpdates: AiFindingReviewInput[] = [];
    const checkUpdates: AiCheckUpdateInput[] = [];

    for (const check of candidates) {
      const verdicts: AiVerdict[] = [];
      let reviewedNow = false;

      for (const finding of check.findings) {
        if (finding.aiStatus) {
          verdicts.push(finding.aiStatus as AiVerdict);
          continue;
        }

        const review = await this.reviewFinding(check.rule, finding, document.images);
        findingUpdates.push(review);
        verdicts.push(review.aiStatus as AiVerdict);
        reviewedNow = true;
      }

      // Solo se persiste el check si esta llamada revisó algo nuevo: si ya
      // estaba completamente revisado, no hay nada que actualizar (idempotente).
      if (reviewedNow) {
        checkUpdates.push({ checkId: check.id, ...aggregate(check.rule, verdicts) });
      }
    }

    if (checkUpdates.length === 0) {
      return analysis;
    }

    const score = computeScore(mergeStatuses(analysis.checks, checkUpdates));

    return this.analyses.applyAiReview({
      analysisId: id,
      score,
      findings: findingUpdates,
      checks: checkUpdates,
    });
  }

  private async reviewFinding(
    rule: string,
    finding: AnalysisFindingInterface,
    images: AnalyzableImage[],
  ): Promise<AiFindingReviewInput> {
    const img = extractImg(finding.evidence);
    const image = img ? findImage(images, img.src) : undefined;

    if (!img || !image) {
      return {
        findingId: finding.id,
        aiStatus: 'REVISION_PENDIENTE',
        aiConfidence: null,
        aiProblem: null,
        aiRecommendation: 'No se pudo localizar el fichero de la imagen; revisar manualmente.',
      };
    }

    // Imagen ya conocida como no accesible (rota, no encontrada; fase 0002): no
    // se envía a la IA (no hay nada que analizar y evita una lectura/descarga inútil).
    if (!image.isAccesible) {
      return {
        findingId: finding.id,
        aiStatus: 'REVISION_PENDIENTE',
        aiConfidence: null,
        aiProblem: null,
        aiRecommendation: 'La imagen no es accesible; revisar manualmente.',
      };
    }

    const input = { elemento: image.originalName, imagePath: image.url, mimeType: image.mimeType };
    const outcome =
      RULE_REVIEWER[rule] === 'altText'
        ? await this.aiReviewer.reviewAltText({ ...input, alt: img.alt })
        : RULE_REVIEWER[rule] === 'containsText'
          ? await this.aiReviewer.reviewContainsText(input)
          : await this.aiReviewer.reviewDecorative(input);

    return {
      findingId: finding.id,
      aiStatus: outcome.estado,
      aiConfidence: outcome.confianza,
      aiProblem: outcome.problema,
      aiRecommendation: outcome.recomendacion,
    };
  }
}

/** Agrega los veredictos de los findings de un check en un único estado. */
function aggregate(rule: string, verdicts: AiVerdict[]): { status: CheckStatus; message: string } {
  const incumple = verdicts.filter((v) => v === 'INCUMPLE').length;
  const pendientes = verdicts.filter((v) => v === 'REVISION_PENDIENTE').length;

  if (incumple > 0) {
    // `rule` siempre es una clave de FAIL_STATUS: solo se agregan checks
    // filtrados previamente por RULE_REVIEWER (mismas claves que FAIL_STATUS).
    return {
      status: FAIL_STATUS[rule] as CheckStatus,
      message: `IA confirma el incumplimiento en ${incumple} de ${verdicts.length} imagen(es)`,
    };
  }
  if (pendientes === 0) {
    return { status: 'VALIDADO_IA', message: `IA valida las ${verdicts.length} imagen(es) marcadas` };
  }
  return {
    status: 'REVISION_PENDIENTE',
    message: `${pendientes} de ${verdicts.length} imagen(es) requieren revisión manual (confianza insuficiente)`,
  };
}

/** Sustituye, para el cálculo del score, el status de los checks revisados. */
function mergeStatuses(
  checks: AnalysisCheckInterface[],
  updates: AiCheckUpdateInput[],
): { status: CheckStatus }[] {
  return checks.map((check) => {
    const update = updates.find((u) => u.checkId === check.id);
    return { status: update ? update.status : (check.status as CheckStatus) };
  });
}

/** Extrae src/alt de un fragmento de evidencia (outerHTML de un <img>). */
function extractImg(evidence: string): { src: string; alt: string } | null {
  const element = parse(evidence).querySelector('img');
  if (!element) {
    return null;
  }
  return { src: element.getAttribute('src') ?? '', alt: element.getAttribute('alt') ?? '' };
}

/** Localiza la imagen del documento a la que corresponde un `src` del HTML. */
function findImage(images: AnalyzableImage[], src: string): AnalyzableImage | undefined {
  return images.find(
    (image) => src === image.relativePath || src === image.url || src.endsWith(image.originalName),
  );
}
