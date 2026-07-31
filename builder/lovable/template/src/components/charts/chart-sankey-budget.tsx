import { TrendingUp } from "lucide-react"
import { Sankey } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
const chartData = {
  nodes: [
    { name: "Revenue" },
    { name: "Staff" },
    { name: "Rent" },
    { name: "Stock" },
    { name: "Profit" },
  ],
  links: [
    { source: 0, target: 1, value: 4200 },
    { source: 0, target: 2, value: 1800 },
    { source: 0, target: 3, value: 1200 },
    { source: 0, target: 4, value: 900 },
  ],
}

const chartConfig = {
  value: { label: "People" },
} satisfies ChartConfig

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sankey</CardTitle>
        <CardDescription>Where visitors come from and where they go.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <Sankey data={chartData} node={{ fill: "var(--chart-3)" }} link={{ stroke: "var(--chart-3)", strokeOpacity: 0.3 }} nodePadding={24} />
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          38% of price-page visitors book <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
