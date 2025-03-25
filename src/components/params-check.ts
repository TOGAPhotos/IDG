export function checkNumberParams(...args: any[]) {
    args.forEach(arg => {
        arg = arg.toNumber();
        if ( isNaN(arg) ) throw new Error(`Expected number of arguments to be NaN.`);
        return arg;
    })

    return args as number[];
}