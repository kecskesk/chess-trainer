export interface ICctRecommendation {
  move: string;
  tooltip: string;
}

export interface ICctRecommendationScored extends ICctRecommendation {
  score: number;
}
