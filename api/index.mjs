import {createCloudHandler} from '../lib/cloud-handler.mjs';
// Resolve deployment secrets in the request context rather than at module load.
export default function handler(req,res){
  return createCloudHandler({env:{KAKAO_REST_KEY:process.env.KAKAO_REST_KEY,KAKAO_MOBILITY_KEY:process.env.KAKAO_MOBILITY_KEY}})(req,res);
}
