import { SupportService } from '../support.service';

describe('SupportService', () => {
  it('is instantiatable (defined)', () => {
    const service = new SupportService();
    expect(service).toBeDefined();
  });

  it('is an instance of SupportService', () => {
    const service = new SupportService();
    expect(service).toBeInstanceOf(SupportService);
  });

  it('has no own public methods beyond the constructor', () => {
    // SupportService is an empty injectable — this guards against accidental
    // removal of the class body while methods are added in the future.
    const service = new SupportService();
    const ownMethods = Object.getOwnPropertyNames(
      Object.getPrototypeOf(service),
    ).filter((m) => m !== 'constructor');

    expect(ownMethods).toHaveLength(0);
  });
});
