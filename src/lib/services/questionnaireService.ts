import { cloudAuthService } from './cloudAuthService';
import { logger } from '../../utils/logger';
import { invoke } from '@tauri-apps/api/core';

const API_BASE = 'https://betterseqta.org/api/questionnaire';

export interface QuestionnaireQuestion {
  id: string;
  question: string;
  options: string[];
  cover_image?: string | null;
  expires_at: number;
  created_at: number;
}

export interface QuestionnaireResults {
  questionId: string;
  totalVotes: number;
  options: Array<{
    index: number;
    text: string;
    count: number;
    percentage: number;
  }>;
}

export interface VoteRequest {
  questionId: string;
  optionIndex: number;
}

export const questionnaireService = {
  /**
   * Get the currently active question (public endpoint)
   */
  async getCurrentQuestion(): Promise<QuestionnaireQuestion | null> {
    try {
      const response = await invoke<any>('proxy_request', {
        url: `${API_BASE}/current`,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        body: {},
      });

      if (response.status === 404) {
        return null;
      }

      if (response.status !== 200) {
        throw new Error(`Failed to fetch current question: ${response.statusText || 'Unknown error'}`);
      }

      // Handle both direct data and nested data structure
      const data = response.data;
      if (data === null) {
        return null;
      }
      return data as QuestionnaireQuestion;
    } catch (error) {
      logger.error('questionnaireService', 'getCurrentQuestion', `Failed to fetch current question: ${error}`, { error });
      return null;
    }
  },

  /**
   * Check if the current user has voted on a question
   */
  async hasVoted(questionId: string): Promise<boolean> {
    try {
      const token = await cloudAuthService.getToken();
      if (!token) {
        return false;
      }

      const response = await invoke<any>('proxy_request', {
        url: `${API_BASE}/has-voted?questionId=${encodeURIComponent(questionId)}`,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `auth_token=${token}`,
        },
        body: {},
      });

      if (response.status === 401) {
        return false;
      }

      if (response.status !== 200) {
        throw new Error(`Failed to check vote status: ${response.statusText || 'Unknown error'}`);
      }

      const data = response.data;
      return (data?.hasVoted || false) as boolean;
    } catch (error) {
      logger.error('questionnaireService', 'hasVoted', `Failed to check vote status: ${error}`, { error, questionId });
      return false;
    }
  },

  /**
   * Submit a vote for a question option
   */
  async vote(questionId: string, optionIndex: number): Promise<boolean> {
    try {
      const token = await cloudAuthService.getToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await invoke<any>('proxy_request', {
        url: `${API_BASE}/vote`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `auth_token=${token}`,
        },
        body: {
          questionId,
          optionIndex,
        } as VoteRequest,
      });

      if (response.status !== 200) {
        const errorMessage = response.data?.message || `Failed to vote: ${response.statusText || 'Unknown error'}`;
        throw new Error(errorMessage);
      }

      const data = response.data;
      return (data?.success || false) as boolean;
    } catch (error) {
      logger.error('questionnaireService', 'vote', `Failed to vote: ${error}`, { error, questionId, optionIndex });
      throw error;
    }
  },

  /**
   * Get voting results for a question (only available after voting)
   */
  async getResults(questionId: string): Promise<QuestionnaireResults | null> {
    try {
      const token = await cloudAuthService.getToken();
      if (!token) {
        return null;
      }

      const response = await invoke<any>('proxy_request', {
        url: `${API_BASE}/results?questionId=${encodeURIComponent(questionId)}`,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `auth_token=${token}`,
        },
        body: {},
      });

      if (response.status === 403 || response.status === 404) {
        return null;
      }

      if (response.status !== 200) {
        throw new Error(`Failed to fetch results: ${response.statusText || 'Unknown error'}`);
      }

      const data = response.data;
      return data as QuestionnaireResults;
    } catch (error) {
      logger.error('questionnaireService', 'getResults', `Failed to fetch results: ${error}`, { error, questionId });
      return null;
    }
  },
};
