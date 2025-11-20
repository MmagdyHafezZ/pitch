import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common'
import { RpcException } from '@nestjs/microservices'
import { MicroserviceExceptionFilter } from '../microservice-exception.filter'

describe('MicroserviceExceptionFilter', () => {
  const createHost = (response: { status: jest.Mock; json: jest.Mock }) =>
    ({
      switchToHttp: () => ({
        getResponse: () => response,
      }),
    }) as unknown as ArgumentsHost

  const getResponseMock = () => {
    const json = jest.fn()
    const status = jest.fn().mockReturnValue({ json })
    return { status, json }
  }

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2024-01-01T00:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('handles HttpException instances', () => {
    const filter = new MicroserviceExceptionFilter()
    const response = getResponseMock()
    const host = createHost(response)

    const exception = new HttpException('Custom error', HttpStatus.BAD_REQUEST)

    filter.catch(exception, host)

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST)
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      message: 'Custom error',
      timestamp: '2024-01-01T00:00:00.000Z',
    })
  })

  it('handles RpcException with string payload', () => {
    const filter = new MicroserviceExceptionFilter()
    const response = getResponseMock()
    const host = createHost(response)

    const exception = new RpcException('RPC error')

    filter.catch(exception, host)

    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR)
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'RPC error',
      timestamp: '2024-01-01T00:00:00.000Z',
    })
  })

  it('handles RpcException with object payload', () => {
    const filter = new MicroserviceExceptionFilter()
    const response = getResponseMock()
    const host = createHost(response)

    const exception = new RpcException({
      statusCode: HttpStatus.CONFLICT,
      message: 'Conflict',
    })

    filter.catch(exception, host)

    expect(response.status).toHaveBeenCalledWith(HttpStatus.CONFLICT)
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.CONFLICT,
      message: 'Conflict',
      timestamp: '2024-01-01T00:00:00.000Z',
    })
  })

  it('falls back to defaults when RpcException object lacks status or message', () => {
    const filter = new MicroserviceExceptionFilter()
    const response = getResponseMock()
    const host = createHost(response)

    const exception = new RpcException({})

    filter.catch(exception, host)

    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR)
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      timestamp: '2024-01-01T00:00:00.000Z',
    })
  })

  it('falls back to internal server error for unknown exceptions', () => {
    const filter = new MicroserviceExceptionFilter()
    const response = getResponseMock()
    const host = createHost(response)

    filter.catch(new Error('boom'), host)

    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR)
    expect(response.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      timestamp: '2024-01-01T00:00:00.000Z',
    })
  })
})
