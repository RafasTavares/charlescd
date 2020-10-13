import { getAccessToken } from 'core/utils/auth';
import { getCircleId } from 'core/utils/circle';
import { getWorkspaceId } from 'core/utils/workspace';
import { QueryKey, useQuery } from 'react-query';

export const headers = {
  Accept: 'application/json',
  'Content-Type': 'application/json'
};

export const buildHeaders = (isFormData = false) => ({
  Authorization: `Bearer ${getAccessToken()}`,
  'x-workspace-id': getWorkspaceId(),
  'x-circle-id': getCircleId(),
  ...(!isFormData && { 'Content-Type': 'application/json' })
});

export const basePath = window.CHARLESCD_ENVIRONMENT?.REACT_APP_API_URI;

const config = {};

export default function useFetch(key: QueryKey[]) {
  return useQuery(key, config);
}

export async function baseQuery(key: string) {
  const res = await fetch(`${basePath}${key}`);
  return await res.json();
}
