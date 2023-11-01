export default function CalculateVote(photoNum:number) {
    if (photoNum < 10) {
        return photoNum;
    }
    let tally = Math.log(photoNum * photoNum) * 5
    return Math.floor(tally * 1000) / 1000;
}