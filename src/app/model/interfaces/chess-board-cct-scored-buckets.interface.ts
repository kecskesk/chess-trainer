import { ICctRecommendationScored } from './cct-recommendation.interface';

export interface IChessBoardCctScoredBuckets {
  captures: ICctRecommendationScored[];
  checks: ICctRecommendationScored[];
  threats: ICctRecommendationScored[];
}
