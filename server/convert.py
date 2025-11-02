import sys
from server.annotation_types import AllAnnotationsV2

def main():
    if len(sys.argv) != 2:
        print("Usage: python convert.py <file.json>")
        sys.exit(1)
    json_file = sys.argv[1]
    annotations = AllAnnotationsV2.load(json_file)
    print(annotations.model_dump_json(indent=2))


if __name__ == "__main__":
    main()
