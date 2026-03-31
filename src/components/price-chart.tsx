'use client'

interface PricePoint {
  price: number
  recordedAt: string
}

interface PriceChartProps {
  data: PricePoint[]
  height?: number
}

function formatPrice(price: number) {
  return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function PriceChart({ data, height = 120 }: PriceChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
        Sem histórico de preço
      </div>
    )
  }

  if (data.length === 1) {
    return (
      <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
        Preço estável desde {formatDate(data[0].recordedAt)}
      </div>
    )
  }

  const prices = data.map((d) => d.price)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const priceRange = maxPrice - minPrice || 1

  const padding = { top: 16, right: 12, bottom: 28, left: 8 }
  const chartW = 480
  const chartH = height

  const innerW = chartW - padding.left - padding.right
  const innerH = chartH - padding.top - padding.bottom

  const points = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1)) * innerW,
    y: padding.top + (1 - (d.price - minPrice) / priceRange) * innerH,
    price: d.price,
    date: d.recordedAt,
  }))

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ')

  // Área preenchida abaixo da linha
  const areaPath =
    `M ${points[0].x},${padding.top + innerH} ` +
    `L ${points[0].x},${points[0].y} ` +
    points.slice(1).map((p) => `L ${p.x},${p.y}`).join(' ') +
    ` L ${points[points.length - 1].x},${padding.top + innerH} Z`

  const trendUp = prices[prices.length - 1] > prices[0]
  const strokeColor = trendUp ? '#ef4444' : '#22c55e'
  const fillColor = trendUp ? '#fef2f2' : '#f0fdf4'

  // Labels: mostrar apenas primeiro, último e pontos intermediários se couber
  const labelIndices = new Set([0, data.length - 1])
  if (data.length <= 6) {
    data.forEach((_, i) => labelIndices.add(i))
  }

  return (
    <div className="w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${chartW} ${chartH}`}
        className="w-full"
        style={{ height }}
        aria-label="Histórico de preço"
      >
        {/* Área */}
        <path d={areaPath} fill={fillColor} />

        {/* Linha */}
        <polyline
          points={polyline}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Pontos e labels */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" fill={strokeColor} />
            {labelIndices.has(i) && (
              <text
                x={p.x}
                y={chartH - 4}
                textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
                fontSize="9"
                fill="#94a3b8"
              >
                {formatDate(p.date)}
              </text>
            )}
          </g>
        ))}

        {/* Preço min/max */}
        <text x={padding.left} y={padding.top + innerH + 2} fontSize="9" fill="#94a3b8">
          {formatPrice(minPrice)}
        </text>
        {minPrice !== maxPrice && (
          <text x={padding.left} y={padding.top + 9} fontSize="9" fill="#94a3b8">
            {formatPrice(maxPrice)}
          </text>
        )}
      </svg>
    </div>
  )
}
