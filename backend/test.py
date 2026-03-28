import os
from dotenv import load_dotenv
load_dotenv()
print(repr(os.getenv('DATA_DIR')))
print(os.path.abspath(os.getenv('DATA_DIR', './data')))
#9v712