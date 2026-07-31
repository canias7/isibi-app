import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { QueryPlan } from "@/components/charts/lib/dbperf"
const root = {
  op: "Gather Merge", rows: 18420, ms: 842,
  children: [
    { op: "Sort", detail: "on created_at", rows: 18420, ms: 806,
      children: [
        { op: "Hash Join", detail: "orders x customers", rows: 18420, ms: 640,
          children: [
            { op: "Seq Scan", detail: "orders", rows: 240000, ms: 388 },
            { op: "Hash", rows: 9200, ms: 96, children: [{ op: "Index Scan", detail: "customers_pkey", rows: 9200, ms: 74 }] },
          ] },
      ] },
  ],
}

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Execution plan</CardTitle>
        <CardDescription>Self time against inclusive</CardDescription>
      </CardHeader>
      <CardContent>
        <QueryPlan root={root} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Self time names the real cost <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One slow query
        </div>
      </CardFooter>
    </Card>
  )
}
