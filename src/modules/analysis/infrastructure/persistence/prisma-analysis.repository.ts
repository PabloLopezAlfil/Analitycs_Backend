import type { PrismaClient } from '../../../../generated/prisma/client.js';
import type { AnalysisInterface } from '../../domain/check.interface.js';
import type { AnalysisRepository, SaveAnalysisInput } from './analysis.repository.js';

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
      checks: row.checks.map((check) => ({
        id: check.id,
        rule: check.rule,
        category: check.category,
        status: check.status,
        message: check.message,
        findings: check.findings.map((finding) => ({
          id: finding.id,
          location: finding.location,
          evidence: finding.evidence,
        })),
      })),
    };
  }
}
