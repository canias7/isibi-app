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
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

// Disagreement is stored NEGATIVE so stackOffset="sign" splits the bar about
// zero. Agreement stacks right, disagreement left, from a shared centre.
const chartData = [
  { question: "Easy to book", disagree: -6, slight: -9, agreeSlight: 28, agree: 57 },
  { question: "Value for money", disagree: -11, slight: -14, agreeSlight: 34, agree: 41 },
  { question: "Would recommend", disagree: -4, slight: -6, agreeSlight: 22, agree: 68 },
  { question: "Waiting time", disagree: -18, slight: -21, agreeSlight: 31, agree: 30 },
]

const chartConfig = {
  disagree: { label: "Disagree", color: "var(--chart-1)" },
  slight: { label: "Slightly disagree", color: "var(--chart-2)" },
  agreeSlight: { label: "Slightly agree", color: "var(--chart-3)" },
  agree: { label: "Agree", color: "var(--chart-4)" },
} satisfies ChartConfig

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Diverging Stacked Bar</CardTitle>
        <CardDescription>Survey answers either side of neutral.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[260px] w-full">
          <BarChart accessibilityLayer data={chartData} layout="vertical" stackOffset="sign" margin={{ left: 12 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" tickLine={false} axisLine={false} />
            <YAxis dataKey="question" type="category" width={100} tickLine={false} axisLine={false} fontSize={11} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="disagree" stackId="a" fill="var(--color-disagree)" />
            <Bar dataKey="slight" stackId="a" fill="var(--color-slight)" />
            <Bar dataKey="agreeSlight" stackId="a" fill="var(--color-agreeSlight)" />
            <Bar dataKey="agree" stackId="a" fill="var(--color-agree)" />
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Most people would recommend us <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
