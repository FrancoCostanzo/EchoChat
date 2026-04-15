const { Router } = require('express');
const { relationshipController } = require('../controllers');
const { validate, authenticate } = require('../middlewares');
const { relationshipDto } = require('../dtos');

const router = Router();
router.use(authenticate);

router.post('/', validate(relationshipDto), (req, res) => relationshipController.create(req, res));
router.delete('/:targetId/:type', (req, res) => relationshipController.remove(req, res));
router.get('/contacts', (req, res) => relationshipController.getContacts(req, res));
router.get('/blocked', (req, res) => relationshipController.getBlocked(req, res));
router.get('/favorites', (req, res) => relationshipController.getFavorites(req, res));

module.exports = router;
