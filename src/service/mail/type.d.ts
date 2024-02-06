declare interface EmailFormat {
    sender: string,
    receiver: string,
    subject: string,
    template: string | null,
    content: string,
}