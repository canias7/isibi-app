import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PluralCoverage } from "@/components/charts/lib/translation"
const locales = [
  { name: "English", required: ["one", "other"] },
  { name: "French", required: ["one", "many", "other"] },
  { name: "Polish", required: ["one", "few", "many", "other"] },
  { name: "Russian", required: ["one", "few", "many", "other"] },
  { name: "Arabic", required: ["zero", "one", "two", "few", "many", "other"] },
  { name: "Welsh", required: ["zero", "one", "two", "few", "many", "other"] },
  { name: "Japanese", required: ["other"] },
]
const formsProvided: Record<string, string[]> = {
  English: ["one", "other"],
  French: ["one", "other"],
  Polish: ["one", "few", "many", "other"],
  Russian: ["one", "few", "other"],
  Arabic: ["one", "two", "few", "many", "other"],
  Welsh: ["one", "other"],
  Japanese: ["other"],
}
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Plural forms</CardTitle>
        <CardDescription>What each language actually uses</CardDescription>
      </CardHeader>
      <CardContent>
        <PluralCoverage locales={locales} formsProvided={formsProvided} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          It does not error, it just reads as nonsense <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          CLDR categories
        </div>
      </CardFooter>
    </Card>
  )
}
