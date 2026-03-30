/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import { Box, Text } from 'ink';
import { ProgressBar } from './ProgressBar.js';
import { theme } from '../semantic-colors.js';
import { formatResetTime } from '../utils/formatters.js';
import { getDisplayString } from '@google/gemini-cli-core';
import { useConfig } from '../contexts/ConfigContext.js';
import { useUIState } from '../contexts/UIStateContext.js';

interface LocalBucket {
  modelId?: string;
  remainingFraction?: number;
  resetTime?: string;
}

interface ModelQuotaDisplayProps {
  buckets?: LocalBucket[];
  availableWidth?: number;
  modelsToShow?: string[];
  title?: string;
}

interface ModelUsageRowProps {
  row: {
    modelId: string;
    name: string;
    usedFraction: number;
    usedPercentage: number;
    resetTime?: string;
    row: object;
    availableWidth?: number;
  };
  availableWidth?: number;
}

const ModelUsageRow = ({ row, availableWidth }: ModelUsageRowProps) => {
  const { terminalWidth } = useUIState();

  const nameLabelLength = 25;
  const resetLabelLength = 26;
  let nameLabel = row.name;
  if (nameLabel.length > nameLabelLength) {
    nameLabel = nameLabel.slice(0, nameLabelLength - 1) + '…';
  } else {
    nameLabel = nameLabel.padEnd(nameLabelLength);
  }
  const percentageLabel = `${row.usedPercentage.toFixed(0)}%`.padEnd(4);
  const resetLabel = row.resetTime
    ? formatResetTime(row.resetTime, 'column')
        .slice(0, resetLabelLength)
        .padEnd(resetLabelLength)
    : ''.padEnd(resetLabelLength);

  const calcWidth = availableWidth ?? terminalWidth;
  const defaultPadding = availableWidth != null ? 0 : 4;
  const barWidth = Math.max(
    0,
    calcWidth - defaultPadding - (nameLabelLength + resetLabelLength + 9),
  );

  return (
    <Box flexDirection="row" width="100%">
      <Box width={nameLabelLength}>
        <Text color={theme.text.primary}>{nameLabel}</Text>
      </Box>

      <Box flexGrow={1}>
        <ProgressBar value={row.usedPercentage} width={barWidth} />
      </Box>

      <Box width={4} marginLeft={1}>
        <Text color={theme.text.primary}>{percentageLabel}</Text>
      </Box>

      <Box width={resetLabelLength} marginLeft={1}>
        <Text color={theme.text.secondary}>Resets: {resetLabel}</Text>
      </Box>
    </Box>
  );
};

export const ModelQuotaDisplay = ({
  buckets,
  availableWidth,
  modelsToShow = ['all'],
  title = 'Model usage',
}: ModelQuotaDisplayProps) => {
  const config = useConfig();

  const modelsWithQuotas = useMemo(() => {
    if (!buckets) return [];

    let filteredBuckets = buckets.filter(
      (b) => b.modelId && b.remainingFraction != null,
    );

    if (modelsToShow.includes('current')) {
      const currentModel = config.getActiveModel?.() ?? config.getModel?.();
      filteredBuckets = filteredBuckets.filter(
        (b) => b.modelId === currentModel,
      );
    } else if (!modelsToShow.includes('all')) {
      filteredBuckets = filteredBuckets.filter(
        (b) => b.modelId && modelsToShow.includes(b.modelId),
      );
    }

    const groupedByTier = new Map<
      string,
      {
        modelId: string;
        remainingFraction: number;
        resetTime?: string;
        name: string;
      }
    >();

    filteredBuckets.forEach((b) => {
      const tier = config?.modelConfigService?.getModelDefinition(
        b.modelId!,
      )?.tier;
      const groupKey = tier ?? b.modelId!;
      const existing = groupedByTier.get(groupKey);

      if (!existing || b.remainingFraction! < existing.remainingFraction) {
        const tierDisplayNames: Record<string, string> = {
          pro: 'Pro',
          flash: 'Flash',
          'flash-lite': 'Flash Lite',
        };
        const name = tier
          ? (tierDisplayNames[tier] ?? tier)
          : getDisplayString(b.modelId!, config);

        groupedByTier.set(groupKey, {
          modelId: b.modelId!,
          remainingFraction: b.remainingFraction!,
          resetTime: b.resetTime,
          name,
        });
      }
    });

    return Array.from(groupedByTier.entries()).map(([key, data]) => {
      const usedFraction = 1 - data.remainingFraction;
      const usedPercentage = usedFraction * 100;
      return {
        modelId: key,
        name: data.name,
        usedFraction,
        usedPercentage,
        resetTime: data.resetTime,
      };
    });
  }, [buckets, config, modelsToShow]);

  if (modelsWithQuotas.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Rule Line */}
      <Box
        borderStyle="single"
        borderTop={true}
        borderBottom={false}
        borderLeft={false}
        borderRight={false}
        borderColor={theme.border.default}
      />

      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold color={theme.text.primary}>
            {title}
          </Text>
        </Box>

        {modelsWithQuotas.map(
          (row) =>
            row.resetTime && (
              <ModelUsageRow
                key={row.modelId}
                row={row}
                availableWidth={availableWidth}
              />
            ),
        )}
      </Box>
    </Box>
  );
};
