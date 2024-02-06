export function checkNumberParams(target: any, propertyName: string, descriptor: PropertyDescriptor):any{

    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
        for (let arg of args) {
            if (isNaN(arg)) {
                throw new Error(`Parameter ${arg} is not a number.`);
            }
        }
        return originalMethod.apply(this, args);
    };

    return descriptor;
}


