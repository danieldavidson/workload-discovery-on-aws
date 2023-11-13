// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import {QueryClient, QueryClientProvider} from "react-query";
import {describe, it, expect, afterEach} from "vitest";
import {render, screen, getByText, findByText, cleanup} from '@testing-library/react'
import {TableWrapper} from '@cloudscape-design/components/test-utils/dom';

import ResourcesPage from "../../../../../components/Explore/Resources/ResourcesPage";
import {diagramSettingsReducer} from "../../../../../components/Contexts/Reducers/DiagramSettingsReducer";
import {ResourceProvider} from "../../../../../components/Contexts/ResourceContext";
import {resourceReducer} from "../../../../../components/Contexts/Reducers/ResourceReducer";
import {DiagramSettingsProvider} from "../../../../../components/Contexts/DiagramSettingsContext";
import userEvent from "@testing-library/user-event";
import {server} from "../../../../mocks/server";
import {graphql} from "msw";

function renderResourcesPage() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                refetchInterval: 60000,
                refetchOnWindowFocus: false,
                retry: 1,
            },
        },
    });

    const initialResourceState = {
        graphResources: [],
        resources: [],
    };

    const initialDiagramSettingsState = {
        canvas: null,
        selectedResources: null,
        resources: [],
    };

    return render(
        <QueryClientProvider client={queryClient}>
            <DiagramSettingsProvider
                initialState={initialDiagramSettingsState}
                reducer={diagramSettingsReducer}>
                <ResourceProvider
                    initialState={initialResourceState}
                    reducer={resourceReducer}>
                    <ResourcesPage/>
                </ResourceProvider>
            </DiagramSettingsProvider>
        </QueryClientProvider>
    );
}

function getCellText(table, row, column) {
    return table.findBodyCell(row, column).getElement()?.innerHTML;
}

describe('Resource Page', () => {

    it('should display account and resource metadata and resources', async () => {
        renderResourcesPage();

        const Overview = await screen.findByTestId('resources-metadata-overview');

        const resourcesDiscoveredParent = await findByText(Overview, /Resources discovered/);
        const resourcesDiscovered = getByText(resourcesDiscoveredParent.parentElement, /\d+/);

        // this value is the sum of the number of resources returned by the mocked
        // `GetResourcesMetadata GQL query
        expect(resourcesDiscovered).toHaveTextContent(29);

        const resourcesTypesParent = await findByText(Overview,/Resources types/);
        const resourcesTypes = getByText(resourcesTypesParent.parentElement, /\d+/);

        // this value is the number of different resource types returned by the mocked
        // `GetResourcesMetadata GQL query
        expect(resourcesTypes).toHaveTextContent(12);

        const accountsParent = await findByText(Overview,/Accounts/);
        const accounts = getByText(accountsParent.parentElement, /\d+/);

        // this value is the number of accounts returned by the mocked
        // `getResourcesAccountMetadataResponse` GQL query
        expect(accounts).toHaveTextContent(2);

        const regionsParent = await findByText(Overview,/Regions/);
        const regions = getByText(regionsParent.parentElement, /\d+/);

        // this value is the number of regions returned by the mocked
        // `GetResourcesRegionMetadata` GQL query
        expect(regions).toHaveTextContent(3);

        // this value is the number of resource types returned by the mocked
        // `getResourcesAccountMetadataResponse` GQL query
        await screen.findByRole('heading', {level: 2, name: /Resources types \(12\)/});

        // this value is the number of resources returned by the mocked
        // `SearchResources` GQL query
        await screen.findByRole('heading', {level: 2, name: /Resources \(29\)/});
    });

    it('should retrieve account metadata in batches of 50', async () => {
        renderResourcesPage();

        server.use(
            graphql.query('GetResourcesMetadata', async (req, res, ctx) => {
                const accounts = [];

                for(let i = 0; i < 100; i++) {
                    const paddedNum = i.toString().padStart(2, 'O');
                    accounts.push({
                        accountId: `xxxxxxxxxx${paddedNum}`,
                        regions: [
                            {name: 'eu-west-1'}
                        ]
                    });
                }

                return res(ctx.data({
                    getResourcesMetadata: {
                        count: 100,
                        accounts,
                        resourceTypes: [
                            {
                                count: 100,
                                type: 'AWS::IAM::Role'
                            }
                        ]
                    }
                }));
            }),
            graphql.query('GetResourcesAccountMetadata', (req, res, ctx) => {
                const reqAccounts = req.variables.accounts;
                const accounts = reqAccounts.map(({accountId}) => {
                    return {
                        accountId,
                        count: 1,
                        resourceTypes: [
                            {
                                count: 1,
                                type: 'AWS::IAM::Role'
                            }
                        ]
                    }
                });
                return res(ctx.data({getResourcesAccountMetadata: accounts}));
            }),
            graphql.query('GetResourcesRegionMetadata', (req, res, ctx) => {
                const reqAccounts = req.variables.accounts;
                const accounts = reqAccounts.map(({accountId}) => {
                    return {
                        accountId,
                        count: 1,
                        regions: [
                            {
                                count: 1,
                                name: 'eu-west-1',
                                resourceTypes: [
                                    {
                                        count: 1,
                                        type: 'AWS::IAM::Role'
                                    }
                                ]
                            }
                        ]
                    }
                });
                return res(ctx.data({getResourcesRegionMetadata: accounts}));
            })
        );

        const Overview = await screen.findByTestId('resources-metadata-overview');

        const resourcesDiscoveredParent = await findByText(Overview, /Resources discovered/);

        const resourcesDiscovered = getByText(resourcesDiscoveredParent.parentElement, /\d+/);

        expect(resourcesDiscovered).toHaveTextContent(100);

        const resourcesTypesParent = await findByText(Overview,/Resources types/);

        const resourcesTypes = getByText(resourcesTypesParent.parentElement, /\d+/);

        expect(resourcesTypes).toHaveTextContent(1);

        const accountsParent = await findByText(Overview,/Accounts/);
        const accounts = getByText(accountsParent.parentElement, /\d+/);

        expect(accounts).toHaveTextContent(100);

        const regionsParent = await findByText(Overview,/Regions/);
        const regions = getByText(regionsParent.parentElement, /\d+/);

        expect(regions).toHaveTextContent(100);

        await screen.findByRole('heading', {level: 2, name: /Resources types \(1\)/});
    });

    it('should filter resources by account id and resource type', async () => {
        renderResourcesPage();

        // filter by account id
        const accountFilterButton = await screen.findByRole('button', { name: /accounts choose accounts to filter by/i });
        await userEvent.click(accountFilterButton);

        const filterOption = screen.getByRole('option', { name: /xxxxxxxxxxxx/i })
        await userEvent.click(filterOption);

        await screen.findByRole('heading', {level: 2, name: /Resources \(13\)/});

        // filter further by resource type
        const ecsClusterCheckbox = await screen.findByRole('checkbox', {
            name: /aws::ecs::cluster is not selected/i
        });

        await userEvent.click(ecsClusterCheckbox);

        await screen.findByRole('heading', {level: 2, name: /Resources \(1\)/});

        const resourcesTable = screen.getByRole('table', {name: /resources$/i});

        const resourcesTableWrapper = new TableWrapper(resourcesTable.parentElement);
        const resourcesTableRows = resourcesTableWrapper.findRows();

        // verify that only a single ECS CLuster is rendered
        expect(resourcesTableRows).toHaveLength(1);

        expect(getCellText(resourcesTableWrapper, 1, 2)).toMatch(/\/icons\/Amazon-Elastic-Container-Service-menu.svg/);
        expect(getCellText(resourcesTableWrapper, 1, 3)).toBe('arn:aws:xxxxxxxxxxxx:eu-west-2:AWS::ECS::Cluster:0Title');
        expect(getCellText(resourcesTableWrapper, 1, 4)).toBe('AWS::ECS::Cluster');
        expect(getCellText(resourcesTableWrapper, 1, 5)).toBe('xxxxxxxxxxxx');
        expect(getCellText(resourcesTableWrapper, 1, 6)).toBe('eu-west-2');
    });

});