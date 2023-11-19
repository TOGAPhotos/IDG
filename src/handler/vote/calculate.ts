export default function CalculateVote(photoNum:number) {
    let tally = Math.log(photoNum * photoNum) * 5
    tally =  Math.floor(tally * 1000) / 1000;

    return tally >= photoNum ? photoNum : tally;
}