import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EditMatrix } from "@/components/charts/lib/biolang"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit distance</CardTitle>
        <CardDescription>The dynamic-programming table with its traceback</CardDescription>
      </CardHeader>
      <CardContent>
        <EditMatrix a="kitten" b="sitting" />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Distance is the bottom-right cell <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Levenshtein
        </div>
      </CardFooter>
    </Card>
  )
}
