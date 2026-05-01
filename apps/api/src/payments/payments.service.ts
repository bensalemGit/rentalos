import { Injectable, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { ReceiptsService } from '../receipts/receipts.service';

@Injectable()
export class PaymentsService {
  private pool = new Pool({ connectionString: process.env.DATABASE_URL });

  constructor(private readonly receiptsService: ReceiptsService) {}

  private async getPeriodPaymentStatus(
    leaseId: string,
    periodYear: number,
    periodMonth: number,
  ) {
    const leaseQ = await this.pool.query(
      `
      SELECT
        l.start_date,
        l.end_date_theoretical,
        COALESCE(a.rent_cents, l.rent_cents) AS rent_cents,
        COALESCE(a.charges_cents, l.charges_cents) AS charges_cents
      FROM leases l
      LEFT JOIN LATERAL (
        SELECT rent_cents, charges_cents
        FROM lease_amounts
        WHERE lease_id = l.id
          AND effective_date <= make_date($2::int, $3::int, 1)
        ORDER BY effective_date DESC
        LIMIT 1
      ) a ON TRUE
      WHERE l.id = $1
      LIMIT 1
      `,
      [leaseId, periodYear, periodMonth],
    );

    if (!leaseQ.rowCount) {
      throw new BadRequestException('Unknown leaseId');
    }

    const lease = leaseQ.rows[0];

    const rentCents = Number(lease.rent_cents || 0);
    const chargesCents = Number(lease.charges_cents || 0);

    const monthStart = new Date(periodYear, periodMonth - 1, 1);
    const monthEnd = new Date(periodYear, periodMonth, 0);
    const daysInMonth = monthEnd.getDate();

    const leaseStartDate = lease.start_date
      ? new Date(lease.start_date)
      : monthStart;

    const leaseEndDate = lease.end_date_theoretical
      ? new Date(lease.end_date_theoretical)
      : monthEnd;

    const effectivePeriodStart =
      leaseStartDate > monthStart ? leaseStartDate : monthStart;

    const effectivePeriodEnd =
      leaseEndDate < monthEnd ? leaseEndDate : monthEnd;

    const occupiedDays =
      effectivePeriodEnd >= effectivePeriodStart
        ? effectivePeriodEnd.getDate() - effectivePeriodStart.getDate() + 1
        : 0;

    if (occupiedDays <= 0) {
      return {
        dueCents: 0,
        paidCents: 0,
        fullyPaid: false,
      };
    }

    const prorataFactor = occupiedDays / daysInMonth;
    const dueCents =
      Math.round(rentCents * prorataFactor) +
      Math.round(chargesCents * prorataFactor);

    const paymentsQ = await this.pool.query(
      `
      SELECT COALESCE(SUM(amount_cents), 0)::int AS paid_cents
      FROM payments
      WHERE lease_id = $1
        AND period_year = $2
        AND period_month = $3
      `,
      [leaseId, periodYear, periodMonth],
    );

    const paidCents = Number(paymentsQ.rows[0]?.paid_cents || 0);

    return {
      dueCents,
      paidCents,
      fullyPaid: dueCents > 0 && paidCents >= dueCents,
    };
  }

  async create(body: any) {
    const { leaseId, paidAt, amountCents, method, note } = body || {};

    if (!leaseId) throw new BadRequestException('Missing leaseId');
    if (!paidAt) throw new BadRequestException('Missing paidAt');

    const amount = Number(amountCents);
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException('Invalid amountCents');
    }

    const paidAtDate = new Date(body.paidAt || body.paid_at);

    const periodYear =
      Number(body.periodYear || body.period_year) ||
      paidAtDate.getFullYear();

    const periodMonth =
      Number(body.periodMonth || body.period_month) ||
      paidAtDate.getMonth() + 1;

    if (!Number.isFinite(periodYear) || !Number.isFinite(periodMonth) || periodMonth < 1 || periodMonth > 12) {
      throw new BadRequestException("Invalid payment period");
    }

    const r = await this.pool.query(
      `
      INSERT INTO payments (
        lease_id,
        paid_at,
        amount_cents,
        method,
        note,
        period_year,
        period_month
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
      `,
      [
        leaseId,
        paidAt,
        amount,
        method || 'virement',
        note || null,
        periodYear,
        periodMonth,
      ],
    );

    const payment = r.rows[0];

    try {
      const periodStatus = await this.getPeriodPaymentStatus(
        leaseId,
        periodYear,
        periodMonth,
      );

      if (periodStatus.fullyPaid) {
        await this.receiptsService.generate({
          leaseId,
          year: periodYear,
          month: periodMonth,
          force: true,
        });
      }
    } catch (e: any) {
      console.error('Auto receipt generation failed:', e?.message || e);
    }

    return payment;
  }

  async list(leaseId: string) {
    if (!leaseId) throw new BadRequestException('Missing leaseId');
    const r = await this.pool.query(
      `SELECT * FROM payments WHERE lease_id=$1 ORDER BY paid_at DESC, created_at DESC`,
      [leaseId]
    );
    return r.rows;
  }

  async remove(id: string) {
    if (!id) throw new BadRequestException('Missing payment id');

    const r = await this.pool.query(
      `
      DELETE FROM payments
      WHERE id = $1
      RETURNING *
      `,
      [id],
    );

    if (!r.rowCount) {
      throw new BadRequestException('Unknown payment id');
    }

    return { ok: true, payment: r.rows[0] };
  }

}
