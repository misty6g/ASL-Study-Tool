export interface SearchResult {
  id: string;
  answer: string;
  video_url: string;
  deck_id: string;
  deck: {
    id: string;
    title: string;
  };
  type: string;
} 