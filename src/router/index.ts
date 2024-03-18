import { Router } from "express";

import { UploadHandler, UploadPreProcess, photoUpload } from "../handler/photo/upload.js";
import { SearchPhoto } from "../handler/photo/search.js";
import { GetFullList } from "../handler/photo/list.js";

import { GetScreenQueue } from "../handler/screen/queue.js";

// import { CreateVote } from "../handler/vote/ceate.js";
// import { Vote } from "../handler/vote/vote.js";
// import { GetVote, GetVoteList } from "../handler/vote/get.js";
// import { DeleteVote } from "../handler/vote/delete.js";
import {UpdatePhotoInfo} from "../handler/photo/update.js";

import P from "../components/auth/permissions.js";
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

router.get("/website",WebsiteHandler.get);

router.post("/user/login",UserHandler.login)
router.post("/user/register",UserHandler.register)
router.get('/user/:id',UserHandler.getUserInfo)

router.get('/photo/:id', PhotoHandler.get);
router.get('/photos/full', GetFullList);
router.get('/search', SearchPhoto);

router.get('/airports', AirportHandler.list);
router.get('/airport/:id', AirportHandler.get)

router.get('/airline/:keyword',AirlineHandler.search)
router.get('/airlines', AirlineHandler.list);

router.get('/aircraft/:reg', AircraftHandler.search)

// router.get('/vote/:id',GetVote);

router.get('/notam',NotamHandler.get)


router.use(P.isLoginMW)
router.get('/users',P.isAdminMW,UserHandler.getUserList)
router.get('/user/search/:keyword',P.isAdminMW,UserHandler.search)
router.put('/user/:id', P.isScreenerMW, UserHandler.update);
router.delete('/user/:id',P.isAdminMW,UserHandler.delete)


router.post('/photo',P.checkUserStatusMW,UploadPreProcess,photoUpload.array('file'),UploadHandler);
router.put('/photo/:id', UpdatePhotoInfo);
router.delete('/photo/:id', P.isScreenerMW, PhotoHandler.delete);

// queue
router.get('/queue/top',  P.isScreenerMW,QueueHandler.getQueuePhoto);
router.get('/queue/screened',P.isScreenerMW,QueueHandler.getScreenedPhoto);
router.get('/queue/photos',P.isScreenerMW,GetScreenQueue)
router.get('/queue/photo/:id',P.isScreenerMW,QueueHandler.getQueuePhoto);
router.put('/queue/photo/:id',P.isScreenerMW,QueueHandler.beater);
router.post('/queue/photo/:id',P.isScreenerMW,QueueHandler.processScreenResult);

router.get('/queue/upload',QueueHandler.getUserUploadQueue)
router.get('/queue/reject',QueueHandler.userRejectQueue);


router.post('/airports', P.checkUserStatusMW, AirportHandler.create);
router.put('/airport/:id',  P.isScreenerMW, AirportHandler.update);
router.delete('/airport/:id',  P.isScreenerMW, AirportHandler.delete);


router.post('/airlines',  P.checkUserStatusMW,AirlineHandler.create);
router.put('/airline/:id',  P.isScreenerMW , AirlineHandler.update);
router.delete('/airline/:id',  P.isScreenerMW, AirlineHandler.delete);


// router.get('/aircrafts',  AircraftHandler.getAircraftList);
router.post('/aircrafts',  P.isStaff,AircraftHandler.create);
router.put('/aircraft/:id',  P.isStaff, AircraftHandler.update);
router.delete('/aircraft/:id',  P.isScreenerMW, AircraftHandler.delete);

// airtype.ts
router.get('/airtypes', AirtypeHandler.getList);
router.post('/airtypes', P.isScreenerMW, AirtypeHandler.create);
router.put('/airtype/:sub_type', P.isScreenerMW, AirtypeHandler.update);
router.delete('/airtype/:sub_type', P.isScreenerMW, AirtypeHandler.delete);

// notam
router.post('/notam',P.isAdminMW,NotamHandler.create)

// vote
// router.post('/vote',CreateVote);
// router.put('/vote/:id',P.checkUserStatusMW,Vote);
//
// router.get('/votes',P.isScreenerMW,GetVoteList);
// router.delete('/vote/:id',P.isAdminMW,DeleteVote)

export default router;