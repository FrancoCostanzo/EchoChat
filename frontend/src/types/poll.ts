/**
 * Encuesta embebida en un mensaje (message.poll). Fuente de verdad en el
 * backend: backend/src/models/poll.model.ts (toPollResponse). Ver la nota de
 * sincronización en types/user.ts.
 */
export interface PollOptionResponse {
  id: string;
  text: string;
  vote_count: number;
  voted: boolean;
}

export interface PollResponse {
  id: string;
  message_id: string;
  question: string;
  is_anonymous: boolean;
  is_multiple: boolean;
  closes_at: string | null;
  is_closed: boolean;
  total_votes: number;
  has_voted: boolean;
  options: PollOptionResponse[];
}

export interface CreatePollRequest {
  conversation_id: string;
  question: string;
  options: string[];
  is_anonymous?: boolean;
  is_multiple?: boolean;
  closes_at?: string | null;
}

export interface VoteRequest {
  option_ids: string[];
}
