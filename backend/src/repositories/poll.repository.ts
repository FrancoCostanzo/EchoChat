import BaseRepository from './base.repository';
import type { Row } from '../types/rows';
import type { PollOptionRow } from '../models/poll.model';

type PollRow = Row<'polls'>;

// Polls embedded in messages (tables: polls, poll_options, poll_votes).
class PollRepository extends BaseRepository<PollRow> {
  constructor() {
    super('polls');
  }

  async createPoll(
    messageId: string,
    { question, is_anonymous, is_multiple, closes_at }: {
      question: string;
      is_anonymous?: boolean;
      is_multiple?: boolean;
      closes_at?: Date | null;
    },
  ): Promise<PollRow> {
    const { rows } = await this.query(
      `INSERT INTO polls (message_id, question, is_anonymous, is_multiple, closes_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [messageId, question, is_anonymous ?? false, is_multiple ?? false, closes_at || null]
    );
    return rows[0];
  }

  async addOption(pollId: string, text: string, sortOrder = 0): Promise<PollOptionRow> {
    const { rows } = await this.query<PollOptionRow>(
      `INSERT INTO poll_options (poll_id, text, sort_order) VALUES ($1, $2, $3) RETURNING *`,
      [pollId, text, sortOrder]
    );
    return rows[0];
  }

  async findByMessageId(messageId: string): Promise<PollRow | null> {
    const { rows } = await this.query(`SELECT * FROM polls WHERE message_id = $1`, [messageId]);
    return rows[0] || null;
  }

  async getOptions(pollId: string): Promise<PollOptionRow[]> {
    const { rows } = await this.query<PollOptionRow>(
      `SELECT * FROM poll_options WHERE poll_id = $1 ORDER BY sort_order`,
      [pollId]
    );
    return rows;
  }

  async getOptionById(optionId: string): Promise<PollOptionRow | null> {
    const { rows } = await this.query<PollOptionRow>(`SELECT * FROM poll_options WHERE id = $1`, [optionId]);
    return rows[0] || null;
  }

  async getUserVotes(pollId: string, userId: string): Promise<string[]> {
    const { rows } = await this.query<{ option_id: string }>(
      `SELECT option_id FROM poll_votes WHERE poll_id = $1 AND user_id = $2`,
      [pollId, userId]
    );
    return rows.map((r) => r.option_id);
  }

  async vote(pollId: string, optionIds: string[], userId: string, isMultiple?: boolean): Promise<void> {
    // Single-choice polls: replace any previous vote
    if (!isMultiple) {
      await this.query(`DELETE FROM poll_votes WHERE poll_id = $1 AND user_id = $2`, [pollId, userId]);
    }
    for (const optionId of optionIds) {
      await this.query(
        `INSERT INTO poll_votes (poll_id, option_id, user_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (poll_id, option_id, user_id) DO NOTHING`,
        [pollId, optionId, userId]
      );
    }
    await this._recount(pollId);
  }

  async retractVote(pollId: string, userId: string): Promise<void> {
    await this.query(`DELETE FROM poll_votes WHERE poll_id = $1 AND user_id = $2`, [pollId, userId]);
    await this._recount(pollId);
  }

  async close(pollId: string): Promise<PollRow> {
    const { rows } = await this.query(
      `UPDATE polls SET is_closed = TRUE WHERE id = $1 RETURNING *`,
      [pollId]
    );
    return rows[0];
  }

  // Keep the denormalized vote_count in sync with poll_votes
  async _recount(pollId: string): Promise<void> {
    await this.query(
      `UPDATE poll_options po
       SET vote_count = (SELECT COUNT(*) FROM poll_votes pv WHERE pv.option_id = po.id)
       WHERE po.poll_id = $1`,
      [pollId]
    );
  }
}

export = new PollRepository();
