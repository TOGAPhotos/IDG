import { Router } from "express";

import Per from "../components/auth/permissions.js";
import UserHandler from "../handler/user/index.js";

import QueueHandler from "../handler/queue/index.js";
import PhotoHandler from "../handler/photo/index.js";

import AircraftHandler from "../handler/info/aircraft.js";
import AirtypeHandler from "../handler/info/airtype.js";
import AirportHandler from "../handler/info/airport.js";
import AirlineHandler from "../handler/info/airline.js";

import NotamHandler from "../handler/notam/handler.js";
import WebsiteHandler from "../handler/info/website.js";


const router = Router();


router.put('/cos',PhotoHandler.updateObjectStatus)

router.get("/website",WebsiteHandler.get);

router.post("/user/login",UserHandler.login)
router.post("/user/register",UserHandler.register)
router.get('/user/:id',UserHandler.getUserInfo)

router.get('/photo/:id', PhotoHandler.get);
router.get('/photos', PhotoHandler.getList);
router.get('/search', PhotoHandler.search);

router.get('/airport', AirportHandler.search);
router.get('/airport/:id', AirportHandler.get)

router.get('/airline',AirlineHandler.search)
router.get('/airline/:id', AirlineHandler.get);
router.get('/airlines', AirlineHandler.list);

router.get('/aircraft', AircraftHandler.search)
router.get('/airtype', AirtypeHandler.search);
router.get('/airtype/:id', AirtypeHandler.get);
// router.get('/vote/:id',GetVote);

router.get('/notam',NotamHandler.get)


router.use(Per.isLoginMW)
router.get('/users',Per.isAdminMW,UserHandler.getUserList)
router.get('/user/search/:keyword',Per.isScreenerMW,UserHandler.search)
router.put('/user/:id', UserHandler.update);
router.delete('/user/:id',Per.isAdminMW,UserHandler.delete)


// router.post('/photo',Per.checkUserStatusMW,UploadPreProcess,photoUpload.array('file'),UploadHandler);
router.post('/photo',Per.checkUserStatusMW,PhotoHandler.upload)
router.put('/photo/:id', PhotoHandler.update);
router.delete('/photo/:id', PhotoHandler.delete);

// queue
router.get('/queue/top',  Per.isScreenerMW,QueueHandler.getQueueTop);
router.get('/queue',Per.isScreenerMW,QueueHandler.getQueue)
// router.get('/queue/screened',Per.isScreenerMW,QueueHandler.getScreenedPhoto);
// router.get('/queue/photos',Per.isScreenerMW,GetScreenQueue)
router.get('/queue/photo/:id',Per.isScreenerMW,QueueHandler.getQueuePhoto);
router.put('/queue/photo/:id',Per.isScreenerMW,QueueHandler.beater);
router.post('/queue/photo/:id',Per.isScreenerMW,QueueHandler.processScreenResult);
router.post('/queue/user/:id',Per.isSeniorScreenerMW,QueueHandler.rejcetQueue)

router.get('/queue/upload',QueueHandler.getUserUploadQueue)
router.get('/queue/reject',QueueHandler.userRejectQueue);

router.get('/airports', AirportHandler.list);
router.post('/airport', Per.checkUserStatusMW, AirportHandler.create);
router.put('/airport/:id',  Per.isScreenerMW, AirportHandler.update);
router.delete('/airport/:id',  Per.isScreenerMW, AirportHandler.delete);


router.post('/airline',AirlineHandler.create);
router.put('/airline/:id',  Per.isStaffMW , AirlineHandler.update);
router.delete('/airline/:id',  Per.isStaffMW, AirlineHandler.delete);


// router.get('/aircrafts',  AircraftHandler.getAircraftList);
router.post('/aircrafts',  Per.isStaff,AircraftHandler.create);
router.put('/aircraft/:id',  Per.isStaff, AircraftHandler.update);
router.delete('/aircraft/:id',  Per.isScreenerMW, AircraftHandler.delete);

// airtype.ts
router.get('/airtypes', AirtypeHandler.list);
router.post('/airtype', AirtypeHandler.create);
router.put('/airtype/:id', Per.isScreenerMW, AirtypeHandler.update);
router.delete('/airtype/:sub_type', Per.isScreenerMW, AirtypeHandler.delete);

// notam
router.post('/notam',Per.isAdminMW,NotamHandler.create)


export default router;