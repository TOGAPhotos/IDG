export function secureSqlString(target: any, propertyKey: string, descriptor: PropertyDescriptor) {

    const originalMethod = descriptor.value;
    descriptor.value = function (...args: any[]) {
        const sanitizedArgs = args.map(arg => {
            if (typeof arg !== "string") return arg;
            return arg.replace(/--/g, "")
                .replace(/'/g, "''")
                .replace(/%/g, "");
        });
        return originalMethod.apply(this, sanitizedArgs);
    };

    return descriptor;
}