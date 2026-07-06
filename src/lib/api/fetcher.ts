import {
  AppError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  InternalServerError,
  NetworkError,
  ParseError,
} from '../errors';
import { logger } from '../logger';

export async function safeFetch<T>(url: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (err: any) {
    logger.error(`Network failure during fetch of ${url}`, err);
    throw new NetworkError();
  }

  // Handle standard status codes before parsing JSON
  if (response.status === 401) {
    throw new UnauthorizedError();
  }
  if (response.status === 403) {
    throw new ForbiddenError();
  }
  if (response.status === 404) {
    throw new NotFoundError();
  }
  if (response.status === 500) {
    throw new InternalServerError();
  }

  let json: any;
  try {
    const text = await response.text();
    if (!text) {
      json = {};
    } else {
      json = JSON.parse(text);
    }
  } catch (err: any) {
    logger.error(`JSON parse failure for response of ${url}`, err);
    throw new ParseError();
  }

  if (!response.ok || json.ok === false) {
    const errorCode = json.error?.code || 'API_ERROR';
    const errorMessage = json.error?.message || json.error || 'Ocurrió un error inesperado.';
    throw new AppError(errorCode, errorMessage, response.status);
  }

  // Return the data envelope if defined, else return the json object itself
  return (json.data !== undefined ? json.data : json) as T;
}
