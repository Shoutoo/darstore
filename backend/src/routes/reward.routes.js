const express = require('express');
const router = express.Router();
const rewardController = require('../controllers/reward.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

router.get('/', rewardController.getRewards);
router.post('/:id/redeem', verifyToken, rewardController.redeemReward);
router.get('/my-claims', verifyToken, rewardController.getMyRedemptions);

module.exports = router;
