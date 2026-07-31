import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { WeaveDraft } from "@/components/charts/lib/craft"
const threading = Array.from({ length: 24 }, (_, i) => i % 4)
const tieUp = [[0, 1], [1, 2], [2, 3], [3, 0]]
const treadling = Array.from({ length: 24 }, (_, i) => i % 4)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Weaving draft</CardTitle>
        <CardDescription>Threading, tie-up, treadling and the cloth</CardDescription>
      </CardHeader>
      <CardContent>
        <WeaveDraft threading={threading} tieUp={tieUp} treadling={treadling} shafts={4} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The cloth is computed from the other three <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Four shafts
        </div>
      </CardFooter>
    </Card>
  )
}
