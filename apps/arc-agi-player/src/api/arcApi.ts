import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type {
  ActionRequest,
  CreateSessionRequest,
  EventsResponse,
  FrameEnvelope,
  GameSummary,
  TimelineResponse,
} from '../domain/types';

export const arcApi = createApi({
  reducerPath: 'arcApi',
  baseQuery: fetchBaseQuery({ baseUrl: '' }),
  tagTypes: ['Games', 'Session', 'Frame', 'Events'],
  endpoints: (builder) => ({
    getGames: builder.query<GameSummary[], void>({
      query: () => '/api/apps/arc-agi/games',
      providesTags: ['Games'],
      transformResponse: (response: { games: GameSummary[] } | GameSummary[]) => {
        if (Array.isArray(response)) return response;
        return response.games ?? [];
      },
    }),

    createSession: builder.mutation<{ session_id: string }, CreateSessionRequest | undefined>({
      query: (body) => ({
        url: '/api/apps/arc-agi/sessions',
        method: 'POST',
        body: body ?? {},
      }),
    }),

    closeSession: builder.mutation<Record<string, unknown>, string>({
      query: (sessionId) => ({
        url: `/api/apps/arc-agi/sessions/${sessionId}`,
        method: 'DELETE',
      }),
    }),

    resetGame: builder.mutation<FrameEnvelope, { sessionId: string; gameId: string }>({
      query: ({ sessionId, gameId }) => ({
        url: `/api/apps/arc-agi/sessions/${sessionId}/games/${gameId}/reset`,
        method: 'POST',
        body: {},
      }),
      invalidatesTags: ['Frame'],
    }),

    performAction: builder.mutation<FrameEnvelope, { sessionId: string; gameId: string; action: ActionRequest }>({
      query: ({ sessionId, gameId, action }) => ({
        url: `/api/apps/arc-agi/sessions/${sessionId}/games/${gameId}/actions`,
        method: 'POST',
        body: action,
      }),
      invalidatesTags: ['Frame'],
    }),

    getEvents: builder.query<EventsResponse, { sessionId: string; afterSeq?: number }>({
      query: ({ sessionId, afterSeq }) => {
        const params = afterSeq != null ? `?after_seq=${afterSeq}` : '';
        return `/api/apps/arc-agi/sessions/${sessionId}/events${params}`;
      },
      providesTags: ['Events'],
    }),

    getTimeline: builder.query<TimelineResponse, string>({
      query: (sessionId) => `/api/apps/arc-agi/sessions/${sessionId}/timeline`,
    }),
  }),
});

export const {
  useGetGamesQuery,
  useCreateSessionMutation,
  useCloseSessionMutation,
  useResetGameMutation,
  usePerformActionMutation,
  useGetEventsQuery,
  useGetTimelineQuery,
} = arcApi;
