import type { ColumnType } from "kysely";

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;

export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export interface Participants {
  id: string;
  name: string;
}

export interface Results {
  count: number;
  id: string;
  participant_id: string;
  voting_id: string;
}

export interface Users {
  id: string;
  name: string;
  password: string;
  refresh_token: string | null;
}

export interface Votes {
  created_at: Generated<Timestamp>;
  id: string;
  participant_id: string;
  user_id: string;
  voting_id: string;
}

export interface Votings {
  end_date: Timestamp;
  id: string;
  init_date: Timestamp;
  open: boolean;
}

export interface DB {
  participants: Participants;
  results: Results;
  users: Users;
  votes: Votes;
  votings: Votings;
}
