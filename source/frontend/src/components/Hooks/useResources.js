// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {useInfiniteQuery, useQuery} from 'react-query';
import useQueryErrorHandler from './useQueryErrorHandler';
import {
    handleResponse,
    searchResources,
} from '../../API/Handlers/ResourceGraphQLHandler';
import {wrapRequest} from '../../Utils/API/HandlerUtils';
import {getStatus} from '../../Utils/StatusUtils';
import {processResourcesError} from '../../Utils/ErrorHandlingUtils';
import * as R from 'ramda';

export const searchQueryKey = 'resourcesSearch';
export const useResourcesSearch = (
    text = '',
    pageSize = 25,
    accounts = [],
    resourceTypes = [],
    config = {}
) => {
    const {handleError} = useQueryErrorHandler();

    const userFilters = {
        text,
    };

    if (accounts?.length > 0) userFilters.accounts = accounts;
    if (resourceTypes?.length > 0) userFilters.resourceTypes = resourceTypes;

    const fetchResults = ({pageParam = 0}) =>
        wrapRequest(processResourcesError, searchResources, {
            ...userFilters,
            pagination: {
                start: pageSize * pageParam,
                end: pageSize * pageParam + pageSize,
            },
        })
            .then(handleResponse)
            .then(
                R.pathOr([], ['body', 'data', 'searchResources', 'resources'])
            );

    const {
        isLoading,
        isError,
        data,
        refetch,
        isFetched,
        isFetching,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useInfiniteQuery(
        [searchQueryKey, text, accounts, resourceTypes, pageSize],
        fetchResults,
        {
            onError: handleError,
            keepPreviousData: true,
            refetchInterval: false,
            getNextPageParam: (lastPage, allPages) =>
                lastPage.length > 0 ? allPages.length : undefined,
            ...config,
        }
    );

    const flattened = R.flatten(data?.pages ?? []);

    return {
        data: flattened,
        isLoading,
        isFetching: isFetching || isFetchingNextPage,
        isFetched,
        isError,
        refetch,
        hasNextPage,
        fetchNextPage,
        status: getStatus(isFetching, isError),
    };
};
export const searchPaginatedQueryKey = 'searchPaginatedQueryKey';
export const useResourcesSearchPaginated = (
    text = '',
    pagination = {start: 0, end: 10},
    accounts = [],
    resourceTypes = [],
    config = {}
) => {
    const {handleError} = useQueryErrorHandler();

    const userFilters = {
        text,
        pagination,
    };

    if (accounts?.length > 0) userFilters.accounts = accounts;
    if (resourceTypes?.length > 0) userFilters.resourceTypes = resourceTypes;

    const {isLoading, isError, data, refetch, isFetching} = useQuery(
        [searchPaginatedQueryKey, text, accounts, resourceTypes, pagination],
        () =>
            wrapRequest(processResourcesError, searchResources, userFilters)
                .then(handleResponse)
                .then(R.pathOr([], ['body', 'data', 'searchResources'])),
        {
            onError: handleError,
            keepPreviousData: true,
            refetchInterval: false,
            ...config,
        }
    );

    return {
        data: data?.resources,
        count: data?.count,
        isLoading,
        isFetching,
        isError,
        refetch,
        status: getStatus(isFetching, isError),
    };
};
