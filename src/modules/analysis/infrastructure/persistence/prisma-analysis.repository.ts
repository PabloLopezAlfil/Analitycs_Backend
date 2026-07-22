import type { PrismaClient } from '../../../../generated/prisma/client.js';
import type {
  AnalysisCheckInterface,
  AnalysisInterface,
  AnalysisSummaryInterface,
} from '../../domain/check.interface.js';
import type {
  AnalysisFilter,
  AnalysisRepository,
  ApplyAiReviewInput,
  SaveAnalysisInput,
} from './analysis.repository.js';

/** Fila de `analysis_checks` (con sus findings) tal como la devuelve Prisma. */
type CheckRow = {
  id: number;
  rule: string;
  category: string;
  status: string;
  message: string;
  findings: {
    id: number;
    location: string;
    evidence: string;
    aiStatus: string | null;
    aiConfidence: string | null;
    aiProblem: string | null;
    aiRecommendation: string | null;
  }[];
};

function toCheckInterface(check: CheckRow): AnalysisCheckInterface {
  return {
    id: check.id,
    rule: check.rule,
    category: check.category,
    status: check.status,
    message: check.message,
    findings: check.findings.map((finding) => ({
      id: finding.id,
      location: finding.location,
      evidence: finding.evidence,
      aiStatus: finding.aiStatus,
      aiConfidence: finding.aiConfidence,
      aiProblem: finding.aiProblem,
      aiRecommendation: finding.aiRecommendation,
    })),
  };
}

/**
 * Adaptador de salida: persiste el agregado (analysis -> checks -> findings)
 * en una única operación (nested create) y devuelve el agregado ya creado.
 */
export class PrismaAnalysisRepository implements AnalysisRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(input: SaveAnalysisInput): Promise<AnalysisInterface> {
    const row = await this.prisma.analysis.create({
      data: {
        htmlId: input.htmlId,
        score: input.score,
        checks: {
          create: input.checks.map((check) => ({
            rule: check.rule,
            category: check.category,
            status: check.status,
            message: check.message,
            findings: {
              create: check.findings.map((finding) => ({
                location: finding.location,
                evidence: finding.evidence,
              })),
            },
          })),
        },
      },
      include: { checks: { include: { findings: true } } },
    });

    return {
      id: row.id,
      htmlId: row.htmlId,
      score: row.score,
      createdAt: row.created_at.toISOString(),
      checks: row.checks.map(toCheckInterface),
    };
  }

  async findAll(filter?: AnalysisFilter): Promise<AnalysisSummaryInterface[]> {
    const take = filter?.limit !== undefined && filter.limit > 0 ? filter.limit : undefined;
    const rows = await this.prisma.analysis.findMany({
      where: filter?.htmlId !== undefined ? { htmlId: filter.htmlId } : {},
      orderBy: { created_at: 'desc' },
      ...(take !== undefined ? { take } : {}),
    });
    return rows.map((row) => ({
      id: row.id,
      htmlId: row.htmlId,
      score: row.score,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async findById(id: number): Promise<AnalysisInterface | null> {
    const row = await this.prisma.analysis.findUnique({
      where: { id },
      include: { checks: { include: { findings: true } } },
    });

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      htmlId: row.htmlId,
      score: row.score,
      createdAt: row.created_at.toISOString(),
      checks: row.checks.map(toCheckInterface),
    };
  }

  /**
   * Aplica una revisión por IA (docs 0005 §7): actualiza los findings
   * revisados, los checks recalculados y el score del análisis en una única
   * transacción, y devuelve el agregado ya actualizado.
   */
  async applyAiReview(input: ApplyAiReviewInput): Promise<AnalysisInterface> {
    await this.prisma.$transaction([
      ...input.findings.map((finding) =>
        this.prisma.analysisFinding.update({
          where: { id: finding.findingId },
          data: {
            aiStatus: finding.aiStatus,
            aiConfidence: finding.aiConfidence,
            aiProblem: finding.aiProblem,
            aiRecommendation: finding.aiRecommendation,
          },
        }),
      ),
      ...input.checks.map((check) =>
        this.prisma.analysisCheck.update({
          where: { id: check.checkId },
          data: { status: check.status, message: check.message },
        }),
      ),
      this.prisma.analysis.update({
        where: { id: input.analysisId },
        data: { score: input.score },
      }),
    ]);

    const updated = await this.findById(input.analysisId);
    if (!updated) {
      throw new Error(`Análisis ${input.analysisId} no encontrado tras aplicar la revisión por IA`);
    }
    return updated;
  }
}
