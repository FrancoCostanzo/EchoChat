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
    const row = await this.db.insertInto('polls')
      .values({
        message_id: messageId,
        question,
        is_anonymous: is_anonymous ?? false,
        is_multiple: is_multiple ?? false,
        closes_at: closes_at || null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as PollRow;
  }

  async addOption(pollId: string, text: string, sortOrder = 0): Promise<PollOptionRow> {
    const row = await this.db.insertInto('poll_options')
      .values({ poll_id: pollId, text, sort_order: sortOrder })
      .returningAll()
      .executeTakeFirstOrThrow();
    return row as PollOptionRow;
  }

  async findByMessageId(messageId: string): Promise<PollRow | null> {
    const row = await this.db.selectFrom('polls').selectAll().where('message_id', '=', messageId).executeTakeFirst();
    return (row as PollRow | undefined) ?? null;
  }

  async getOptions(pollId: string): Promise<PollOptionRow[]> {
    return this.db.selectFrom('poll_options').selectAll()
      .where('poll_id', '=', pollId)
      .orderBy('sort_order')
      .execute() as Promise<PollOptionRow[]>;
  }

  async getOptionById(optionId: string): Promise<PollOptionRow | null> {
    const row = await this.db.selectFrom('poll_options').selectAll().where('id', '=', optionId).executeTakeFirst();
    return (row as PollOptionRow | undefined) ?? null;
  }

  async getUserVotes(pollId: string, userId: string): Promise<string[]> {
    const rows = await this.db.selectFrom('poll_votes').select('option_id')
      .where('poll_id', '=', pollId)
      .where('user_id', '=', userId)
      .execute();
    return rows.map((r) => r.option_id);
  }

  async vote(pollId: string, optionIds: string[], userId: string, isMultiple?: boolean): Promise<void> {
    // Single-choice polls: replace any previous vote
    if (!isMultiple) {
      await this.db.deleteFrom('poll_votes').where('poll_id', '=', pollId).where('user_id', '=', userId).execute();
    }
    for (const optionId of optionIds) {
      await this.db.insertInto('poll_votes')
        .values({ poll_id: pollId, option_id: optionId, user_id: userId })
        .onConflict((oc) => oc.columns(['poll_id', 'option_id', 'user_id']).doNothing())
        .execute();
    }
    await this._recount(pollId);
  }

  async retractVote(pollId: string, userId: string): Promise<void> {
    await this.db.deleteFrom('poll_votes').where('poll_id', '=', pollId).where('user_id', '=', userId).execute();
    await this._recount(pollId);
  }

  async close(pollId: string): Promise<PollRow> {
    const row = await this.db.updateTable('polls')
      .set({ is_closed: true })
      .where('id', '=', pollId)
      .returningAll()
      .executeTakeFirst();
    return row as PollRow;
  }

  // Keep the denormalized vote_count in sync with poll_votes
  async _recount(pollId: string): Promise<void> {
    await this.db.updateTable('poll_options as po')
      .set((eb) => ({
        vote_count: eb.selectFrom('poll_votes as pv')
          .select((s) => s.fn.countAll<number>().as('n'))
          .whereRef('pv.option_id', '=', 'po.id'),
      }))
      .where('po.poll_id', '=', pollId)
      .execute();
  }
}

export default new PollRepository();
