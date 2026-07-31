import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LineLength } from "@/components/charts/lib/typography"
const columns = [
  { name: "Phone", widthPx: 328 },
  { name: "Tablet", widthPx: 560 },
  { name: "Article, desktop", widthPx: 680 },
  { name: "Full-bleed desktop", widthPx: 1180 },
  { name: "Sidebar", widthPx: 240 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Measure</CardTitle>
        <CardDescription>Characters per line at each column width</CardDescription>
      </CardHeader>
      <CardContent>
        <LineLength columns={columns} fontSizePx={16} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The fix is the size or the measure, never leading <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          16px body
        </div>
      </CardFooter>
    </Card>
  )
}
