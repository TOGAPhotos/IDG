import { Router } from "express";

import { Login } from "../handler/user/login.js";
import { Register } from "../handler/user/register.js";
import { GetUserInfo } from "../handler/user/get.js";

import { GetWebsiteInfo } from "../handler/website/info.js";

import { GetPhoto } from "../handler/photo/get.js";
import { SearchPhoto } from "../handler/photo/search.js";
import { GetFullList } from "../handler/photo/list.js";

import { GetQueueTop } from "../handler/screen/queue.js";
import { GetScreenPhoto } from "../handler/screen/get.js";

import { IsLogin,IsScreener,IsAdmin } from "../components/auth/permissions.js";

import { SetQueueStatus } from "../handler/screen/beater.js";
import { ProcessScreenResult } from "../handler/screen/process.js";

import { CreateVote } from "../handler/vote/ceate.js";
import { Vote } from "../handler/vote/vote.js";
import { GetVote, GetVoteList } from "../handler/vote/get.js";
import { DeleteVote } from "../handler/vote/delete.js";

import { CreateAirport } from "../handler/info/airport/create.js";
import { GetAirport,GerAirportList } from "../handler/info/airport/get.js";
import { UpdateAirportInfo } from "../handler/info/airport/update.js";
import { DeleteAirport } from "../handler/info/airport/delete.js";

import { CreateAirline } from "../handler/info/airline/create.js";
import { SearchAirline,GetAirlineList } from "../handler/info/airline/get.js";
import { UpdateAirlineInfo } from "../handler/info/airline/update.js";
import { DeleteAirline } from "../handler/info/airline/delete.js";
const router = Router();

router.get("/website",GetWebsiteInfo);

// user
router.post("/user/login",Login)
router.post("/user/register",Register)
router.get('/user/:id',GetUserInfo)

// photo
router.get('/photo/:id', GetPhoto);
router.get('/photos/full', GetFullList);
router.get('/search', SearchPhoto);

// queue
router.get('/queue/top', IsLogin, IsScreener,GetQueueTop);
router.get('/queue/photo/:id',IsLogin,IsScreener,GetScreenPhoto);
router.put('/queue/photo/:id',IsLogin,IsScreener,SetQueueStatus);
router.post('/queue/photo/:id',IsLogin,IsScreener,ProcessScreenResult);

// airport
router.get('/airports', GerAirportList);
router.get('/airport/:id', GetAirport)
router.post('/airports', IsLogin, CreateAirport);
router.put('/airport/:id', IsLogin, IsScreener, UpdateAirportInfo);
router.delete('/airport/:id', IsLogin, IsScreener, DeleteAirport);


// airline
router.get('/airline/:keyword',SearchAirline)
router.get('/airlines', GetAirlineList);
router.post('/airlines', IsLogin, CreateAirline);
router.put('/airlines/:id', IsLogin, IsScreener , UpdateAirlineInfo);
router.delete('/airlines/:id', IsLogin, IsScreener, DeleteAirline);

// aircraft
router.get('/aircraft/:reg', SearchAircraft)
router.get('/aircrafts', IsLogin, GetAircraftList);
router.post('/aircrafts', IsLogin, AddNewAircraftRecord);
router.put('/aircraft/:id', IsLogin, UpdateAircraftRecord);
router.delete('/aircraft/:id', IsLogin, IsScreener, DeleteAircraftRecord);

// airtype
router.get('/airtypes', IsLogin, GetAirTypeList);
router.post('/airtypes', IsLogin, IsScreener, AddNewAirtype);
router.put('/airtype/:sub_type', IsLogin, IsScreener, UpdateAirtype);
router.delete('/airtype/:sub_type', IsLogin, IsScreener, DeleteAirtype);

// vote
router.post('/vote',IsLogin,CreateVote);
router.put('/vote/:id',IsLogin,Vote);
router.get('/vote/:id',GetVote);
router.get('/votes',IsLogin,IsScreener,GetVoteList);
router.delete('/vote/:id',IsLogin,IsAdmin,DeleteVote)

export default router;