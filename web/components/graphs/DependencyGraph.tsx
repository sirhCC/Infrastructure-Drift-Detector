'use client';

import { useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

interface ResourceNode {
  id: string;
  type: string;
  name: string;
  status?: 'healthy' | 'warning' | 'critical';
  dependencies?: string[];
}

interface DependencyGraphProps {
  resources: ResourceNode[];
}

const nodeTypes = {
  // Custom node types can be added here
};

export default function DependencyGraph({ resources }: DependencyGraphProps) {
  // Convert resources to React Flow nodes
  const initialNodes: Node[] = resources.map((resource, index) => ({
    id: resource.id,
    type: 'default',
    data: {
      label: (
        <div className="text-xs">
          <div className="font-semibold">{resource.name}</div>
          <div className="text-gray-500">{resource.type}</div>
        </div>
      ),
    },
    position: { x: (index % 4) * 250, y: Math.floor(index / 4) * 150 },
    style: {
      background:
        resource.status === 'critical'
          ? '#fee'
          : resource.status === 'warning'
          ? '#fef3c7'
          : '#f0fdf4',
      border: `2px solid ${
        resource.status === 'critical'
          ? '#dc2626'
          : resource.status === 'warning'
          ? '#f59e0b'
          : '#10b981'
      }`,
      borderRadius: '8px',
      padding: '10px',
    },
  }));

  // Convert dependencies to React Flow edges
  const initialEdges: Edge[] = [];
  resources.forEach((resource) => {
    if (resource.dependencies) {
      resource.dependencies.forEach((depId) => {
        initialEdges.push({
          id: `${resource.id}-${depId}`,
          source: depId,
          target: resource.id,
          type: 'smoothstep',
          animated: true,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
          },
        });
      });
    }
  });

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div style={{ width: '100%', height: '600px' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Controls />
        <MiniMap />
        <Background gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}
