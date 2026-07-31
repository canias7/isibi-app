import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BaselineGrid } from "@/components/charts/lib/design"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Baseline rhythm</CardTitle>
        <CardDescription>Whether the line height lands on the grid</CardDescription>
      </CardHeader>
      <CardContent>
        <BaselineGrid gridPx={8} fontPx={16} lineHeight={1.5} lines={9} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Drift is invisible until it is a column <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          8px grid
        </div>
      </CardFooter>
    </Card>
  )
}
