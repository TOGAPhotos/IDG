import Notam from "../../dto/notam.js";

interface NotamI {
  id: number;
  title: string;
  content: string;
}

export default class NotamCache {
  private notam: NotamI;

  private setNotamCache(id: number, title: string, content: string): void {
    this.notam = { id, title, content };
  }

  public getCache(): NotamI {
    return this.notam;
  }

  public async renewCache(): Promise<void> {
    const dbResult = await Notam.getNewest();
    this.setNotamCache(dbResult.id, dbResult.title, dbResult.content);
  }
}
