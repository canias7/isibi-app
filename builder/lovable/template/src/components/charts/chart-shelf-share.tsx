import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ShelfShare } from "@/components/charts/lib/retail2"
const brands = [
  { name: "Hero brand", spaceShare: 0.34, salesShare: 0.41 },
  { name: "Own label", spaceShare: 0.28, salesShare: 0.31 },
  { name: "Premium", spaceShare: 0.22, salesShare: 0.11 },
  { name: "Value", spaceShare: 0.1, salesShare: 0.13 },
  { name: "Seasonal", spaceShare: 0.06, salesShare: 0.04 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Space against sales</CardTitle>
        <CardDescription>Who earns their shelf</CardDescription>
      </CardHeader>
      <CardContent>
        <ShelfShare brands={brands} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A mismatch is visible without arithmetic <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Category review
        </div>
      </CardFooter>
    </Card>
  )
}
