import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ReferendumSplit } from "@/components/charts/lib/civic"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>The result</CardTitle>
        <CardDescription>Of those who voted, and of everyone</CardDescription>
      </CardHeader>
      <CardContent>
        <ReferendumSplit yes={1642300} no={1394100} electorate={4180000} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Two denominators, two different claims <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Single question
        </div>
      </CardFooter>
    </Card>
  )
}
