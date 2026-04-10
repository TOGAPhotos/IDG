export async function productionOnly(func: () => Promise<void>) {
    if (process.env.NODE_ENV !== "production") return;
    await func();
}

export async function developmentOnly(func: () => Promise<void>) {
    if (process.env.NODE_ENV !== "production") return;
    await func();
}