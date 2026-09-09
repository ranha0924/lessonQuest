import type { Actor } from '@lessonquest/contracts';

export interface AuthProvider {
  resolve(authorizationHeader: string | undefined): Actor | Promise<Actor>;
}
