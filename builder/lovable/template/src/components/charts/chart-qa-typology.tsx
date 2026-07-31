import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { QaTypology } from "@/components/charts/lib/translation"
const locales = ["German", "French", "Spanish", "Japanese", "Polish", "Portuguese"]
const categories = ["Accuracy", "Terminology", "Style", "Locale", "Markup"]
const findings = [
  [14, 22, 31, 6, 4],
  [9, 11, 18, 4, 3],
  [11, 8, 14, 5, 2],
  [26, 34, 19, 12, 8],
  [7, 6, 9, 3, 5],
  [18, 14, 21, 7, 3],
]
const wordCounts = [42000, 38000, 36000, 21000, 12000, 34000]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Review findings</CardTitle>
        <CardDescription>Per thousand words, never counts</CardDescription>
      </CardHeader>
      <CardContent>
        <QaTypology
          locales={locales}
          categories={categories}
          findings={findings}
          wordCounts={wordCounts}
          threshold={1.6}
        />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A raw count ranks whichever locale had the most text <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Quarterly review
        </div>
      </CardFooter>
    </Card>
  )
}
