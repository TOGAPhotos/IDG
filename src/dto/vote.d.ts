import { Prisma } from "../generated/prisma/client.js";

export type VoteQueryArgs = Prisma.vote_listWhereInput;
export type VoteCreateArgs = Prisma.vote_listCreateInput;
export type VoteRecordCreateArgs = Omit<Prisma.vote_recordCreateInput, 'create_time'>;
export type VoteEventStatus = NonNullable<VoteQueryArgs["status"]>;
export type VoteType = NonNullable<VoteQueryArgs["type"]>;
