import { gql, useQuery } from "@apollo/client";
import { Table, Typography } from "antd";
import "antd/dist/antd.css";
import GraphiQL from "graphiql";
import "graphiql/graphiql.min.css";
import fetch from "isomorphic-fetch";
import React from "react";
import { Address } from "../components";

function Subgraph(props) {
  function graphQLFetcher(graphQLParams) {
    return fetch(props.subgraphUri, {
      method: "post",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(graphQLParams),
    }).then(response => response.json());
  }

  const EXAMPLE_GRAPHQL = `
  {
    games {
      id,
      gameOn,
      winner,
      height,
      width,
      curseDropCount,
      curseNextGameTicker,
      curseDropCount,
      curseInterval,
      ticker,
      tickerBlock,
      createdAt,
      updatedAt
    },
    players {
        id,
        x,
        y,
        loogieId,
        health,
        ticker,
        tickerBlock,
        createdAt,
        updatedAt
    },
    worldMatrixes {
      id,
      x,
      y,
      healthAmountToCollect,
      cursed,
      player {
        id,
        x,
        y,
        loogieId,
        health,
        ticker,
        tickerBlock,
        createdAt,
        updatedAt
      }
    }
  }
  `;

  const EXAMPLE_GQL = gql(EXAMPLE_GRAPHQL);
  const { loading, data } = useQuery(EXAMPLE_GQL, { pollInterval: 2500 });

  const worldMatrixColumns = [
    {
      title: "id",
      dataIndex: "id",
      key: "id",
    },
    {
      title: "cursed",
      dataIndex: "cursed",
      key: "cursed",
      render: record => {
        console.log("🚀 ~ file: Subgraph.jsx ~ line 54 ~ Subgraph ~ record", record);
        return `${record}`;
      },
    },
    {
      title: "health to collect",
      dataIndex: "healthAmountToCollect",
      key: "healthAmountToCollect",
    },
    {
      title: "player",
      dataIndex: "player",
      key: "playerAddress",
      render: record =>
        record ? <Address value={record.id} ensProvider={props.mainnetProvider} fontSize={16} /> : null,
    },
    {
      title: "player health",
      dataIndex: "player",
      key: "playerHealth",
      render: record => {
        console.log("🚀 ~ file: Subgraph.jsx ~ line 84 ~ Subgraph ~ record", record);
        return record ? parseInt(record.health, 10) : null;
      },
    },
  ];

  const playerColumns = [
    {
      title: "id",
      dataIndex: "id",
      key: "id",
      render: record => (record ? <Address value={record} ensProvider={props.mainnetProvider} fontSize={16} /> : null),
    },
    {
      title: "health",
      dataIndex: "health",
      key: "health",
    },
    {
      title: "x",
      dataIndex: "x",
      key: "x",
    },
    {
      title: "y",
      dataIndex: "y",
      key: "y",
    },
  ];

  const gameColumns = [
    {
      title: "id",
      dataIndex: "id",
      key: "id",
    },
    {
      title: "gameOn",
      dataIndex: "gameOn",
      key: "gameOn",
      render: record => (record ? "true" : "false"),
    },
    {
      title: "height",
      dataIndex: "height",
      key: "height",
    },
    {
      title: "width",
      dataIndex: "width",
      key: "width",
    },
    {
      title: "restart block number",
      dataIndex: "restart",
      key: "restart",
    },
    {
      title: "next curse block number",
      dataIndex: "curseNextGameTicker",
      key: "curseNextGameTicker",
    },
    // {
    //   title: "gameOn",
    //   dataIndex: "gameOn",
    //   key: "gameOn",
    // },
    // {
    //   title: "createdAt",
    //   dataIndex: "createdAt",
    //   key: "createdAt",
    // },
  ];

  const deployWarning = (
    <div style={{ marginTop: 8, padding: 8 }}>Warning: 🤔 Have you deployed your subgraph yet?</div>
  );

  return (
    <>
      <div style={{ margin: 32, height: 400, border: "1px solid #888888", textAlign: "left" }}>
        <GraphiQL fetcher={graphQLFetcher} docExplorerOpen query={EXAMPLE_GRAPHQL} />
      </div>

      <div style={{ width: "100%", paddingBottom: 64 }}>
        {data ? (
          <>
            <Table dataSource={data.games} columns={gameColumns} rowKey="id" />
            <Table dataSource={data.players} columns={playerColumns} rowKey="id" />
            <Table dataSource={data.worldMatrixes} columns={worldMatrixColumns} rowKey="id" />
          </>
        ) : (
          <Typography>{loading ? "Loading..." : deployWarning}</Typography>
        )}
      </div>

      <div style={{ padding: 64 }}>...</div>
    </>
  );
}

export default Subgraph;
