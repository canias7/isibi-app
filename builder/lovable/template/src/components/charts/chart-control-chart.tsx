import { TrendingUp } from "lucide-react"

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
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts"

const values = [42, 45, 41, 44, 43, 46, 40, 44, 58, 43, 45, 42, 44, 41, 43]
const mean = values.reduce((s, v) => s + v, 0) / values.length
const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length)
// Three sigma is the convention: about 1 point in 370 falls outside by chance,
// so a point beyond it is worth investigating rather than shrugging at.
const ucl = mean + 3 * sd
const lcl = mean - 3 * sd

const chartData = values.map((v, i) => ({ n: "#" + (i + 1), value: v }))

const chartConfig = {
  value: { label: "Minutes", color: "var(--chart-1)" },
} satisfies ChartConfig

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Control Chart</CardTitle>
        <CardDescription>A measure against its control limits.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <LineChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="n" tickLine={false} axisLine={false} tickMargin={8} fontSize={10} />
            <YAxis tickLine={false} axisLine={false} domain={["dataMin - 6", "dataMax + 6"]} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ReferenceLine y={ucl} stroke="var(--destructive)" strokeDasharray="4 4" label={{ value: "UCL", position: "insideTopRight", fontSize: 10 }} />
            <ReferenceLine y={mean} stroke="var(--foreground)" strokeOpacity={0.4} />
            <ReferenceLine y={lcl} stroke="var(--destructive)" strokeDasharray="4 4" label={{ value: "LCL", position: "insideBottomRight", fontSize: 10 }} />
            <Line dataKey="value" type="linear" stroke="var(--color-value)" strokeWidth={2} dot={{ r: 2.5 }} />
          </LineChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          One point is out of control <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
