import { Logger } from '@nestjs/common';

const noop = () => undefined;

// Silence Nest Logger static calls
jest.spyOn(Logger, 'log').mockImplementation(noop);
jest.spyOn(Logger, 'warn').mockImplementation(noop);
jest.spyOn(Logger, 'debug').mockImplementation(noop);
jest.spyOn(Logger, 'verbose').mockImplementation(noop);

jest.spyOn(Logger, 'error').mockImplementation(noop);
